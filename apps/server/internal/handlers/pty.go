// Package handlers — pty.go
//
// WebSocket-backed PTY for the browser Terminal app. Spawns the configured
// shell, wires bytes both ways, handles xterm.js resize control messages.
//
// Disabled by default. Enabled with `ENABLE_PTY=true` because it spawns
// a real shell with the server process's privileges. Always behind JWT
// auth — token can come either from the standard `Authorization: Bearer`
// header or the `?token=...` query string (browsers can't set arbitrary
// headers on `new WebSocket()`).
package handlers

import (
	"encoding/json"
	"io"
	"log"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"

	"github.com/yowanda/cloudos/server/internal/services"
)

// resizeMsg matches the JSON the frontend sends on xterm `onResize` events.
type resizeMsg struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

type PTYHandler struct {
	auth    *services.AuthService
	shell   string
	enabled bool
}

func NewPTYHandler(auth *services.AuthService, shell string, enabled bool) *PTYHandler {
	return &PTYHandler{auth: auth, shell: shell, enabled: enabled}
}

// Health reports whether the PTY backend is enabled. Public on purpose —
// the browser uses this to decide whether to wire xterm to the WS or fall
// back to the built-in command parser. No secrets in the response.
func (h *PTYHandler) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"enabled": h.enabled,
		"shell":   shellName(h.shell, h.enabled),
	})
}

// Upgrade is the HTTP handler that a) gates the upgrade behind a valid
// JWT (Authorization header OR ?token= query param) and b) flips the
// request into the WS protocol via fiber-websocket. The actual shell
// loop lives in WS.
func (h *PTYHandler) Upgrade(c *fiber.Ctx) error {
	if !h.enabled {
		return c.Status(403).JSON(fiber.Map{"error": "pty disabled on this server"})
	}
	tok := tokenFromRequest(c)
	if tok == "" {
		return c.Status(401).JSON(fiber.Map{"error": "missing token"})
	}
	uid, err := h.auth.ValidateToken(tok)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "invalid token"})
	}
	c.Locals("ptyUserID", uid.String())
	if !websocket.IsWebSocketUpgrade(c) {
		return c.Status(426).SendString("Upgrade Required")
	}
	return c.Next()
}

// WS is the WebSocket loop. fiber-websocket guarantees the connection is
// upgraded before this is called.
func (h *PTYHandler) WS(conn *websocket.Conn) {
	defer conn.Close()

	if !h.enabled {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("pty disabled on this server\r\n"))
		return
	}

	cmd := exec.Command(h.shell)
	cmd.Env = append(cmd.Env, "TERM=xterm-256color")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("failed to start shell: "+err.Error()+"\r\n"))
		return
	}
	defer func() {
		_ = ptmx.Close()
		_ = cmd.Process.Kill()
		_, _ = cmd.Process.Wait()
	}()

	// Default size — gets overwritten by the first resize message from
	// the client.
	_ = pty.Setsize(ptmx, &pty.Winsize{Rows: 24, Cols: 80})

	var writeMu sync.Mutex
	wsWrite := func(mt int, p []byte) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		return conn.WriteMessage(mt, p)
	}

	// Goroutine: pty -> ws (binary frames so escape sequences pass through).
	done := make(chan struct{})
	go func() {
		defer close(done)
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				if werr := wsWrite(websocket.BinaryMessage, buf[:n]); werr != nil {
					return
				}
			}
			if err != nil {
				if err != io.EOF {
					log.Printf("pty read: %v", err)
				}
				return
			}
		}
	}()

	// Main loop: ws -> pty. Text messages are interpreted as control
	// JSON (resize), binary messages are written to the pty stdin.
	for {
		select {
		case <-done:
			return
		default:
		}
		mt, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		switch mt {
		case websocket.BinaryMessage:
			if _, werr := ptmx.Write(data); werr != nil {
				return
			}
		case websocket.TextMessage:
			// Resize control JSON: {"type":"resize","cols":80,"rows":24}.
			// Anything else is forwarded as raw input — useful for
			// browsers that send keystrokes as text frames.
			if msg, ok := parseResize(data); ok {
				_ = pty.Setsize(ptmx, &pty.Winsize{Rows: msg.Rows, Cols: msg.Cols})
				continue
			}
			if _, werr := ptmx.Write(data); werr != nil {
				return
			}
		}
	}
}

// tokenFromRequest extracts the JWT from either the Authorization header
// or the ?token= query parameter. The browser WebSocket API can't set
// arbitrary headers, so the query-param fallback is what production
// clients actually use.
func tokenFromRequest(c *fiber.Ctx) string {
	if h := c.Get("Authorization"); len(h) > 7 && h[:7] == "Bearer " {
		return h[7:]
	}
	return c.Query("token")
}

func parseResize(data []byte) (resizeMsg, bool) {
	var m resizeMsg
	if err := json.Unmarshal(data, &m); err != nil {
		return resizeMsg{}, false
	}
	if m.Type != "resize" || m.Cols == 0 || m.Rows == 0 {
		return resizeMsg{}, false
	}
	return m, true
}

// shellName returns the shell path only when the feature is enabled —
// avoids leaking the shell binary location through /api/v1/pty/health
// when pty is off.
func shellName(shell string, enabled bool) string {
	if !enabled {
		return ""
	}
	return shell
}
