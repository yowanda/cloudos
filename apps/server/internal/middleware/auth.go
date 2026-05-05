package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/yowanda/cloudos/server/internal/services"
)

func Auth(authService *services.AuthService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
		}

		token := auth[7:]
		userID, err := authService.ValidateToken(token)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
		}

		c.Locals("userID", userID)
		return c.Next()
	}
}
