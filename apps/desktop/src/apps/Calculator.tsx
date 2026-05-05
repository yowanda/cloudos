import { Component, createSignal, For } from "solid-js";

const Calculator: Component<{ windowId: string }> = () => {
  const [display, setDisplay] = createSignal("0");
  const [prevValue, setPrevValue] = createSignal<number | null>(null);
  const [operator, setOperator] = createSignal<string | null>(null);
  const [resetNext, setResetNext] = createSignal(false);

  const handleNumber = (num: string) => {
    if (resetNext()) {
      setDisplay(num);
      setResetNext(false);
    } else {
      setDisplay(display() === "0" ? num : display() + num);
    }
  };

  const handleOperator = (op: string) => {
    const current = parseFloat(display());
    if (prevValue() !== null && operator() && !resetNext()) {
      const result = calculate(prevValue()!, operator()!, current);
      setDisplay(String(result));
      setPrevValue(result);
    } else {
      setPrevValue(current);
    }
    setOperator(op);
    setResetNext(true);
  };

  const calculate = (a: number, op: string, b: number): number => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (prevValue() !== null && operator()) {
      const result = calculate(prevValue()!, operator()!, parseFloat(display()));
      setDisplay(String(result));
      setPrevValue(null);
      setOperator(null);
      setResetNext(true);
    }
  };

  const handleClear = () => {
    setDisplay("0");
    setPrevValue(null);
    setOperator(null);
    setResetNext(false);
  };

  const handleDot = () => {
    if (!display().includes(".")) setDisplay(display() + ".");
  };

  const handlePercent = () => {
    setDisplay(String(parseFloat(display()) / 100));
  };

  const handleToggleSign = () => {
    setDisplay(String(-parseFloat(display())));
  };

  const buttons = [
    ["C", "±", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["0", ".", "="],
  ];

  const handleButton = (btn: string) => {
    if (btn >= "0" && btn <= "9") handleNumber(btn);
    else if (["+", "-", "×", "÷"].includes(btn)) handleOperator(btn);
    else if (btn === "=") handleEquals();
    else if (btn === "C") handleClear();
    else if (btn === ".") handleDot();
    else if (btn === "%") handlePercent();
    else if (btn === "±") handleToggleSign();
  };

  const isOperator = (btn: string) => ["+", "-", "×", "÷"].includes(btn);

  return (
    <div class="h-full flex flex-col bg-[#1c1c1e]">
      {/* Display */}
      <div class="flex-shrink-0 p-4 flex flex-col items-end justify-end min-h-[80px]">
        <div class="text-[#8e8e93] text-xs mb-1">
          {prevValue() !== null ? `${prevValue()} ${operator()}` : ""}
        </div>
        <div class="text-white text-3xl font-light tracking-wide">{display()}</div>
      </div>

      {/* Buttons */}
      <div class="flex-1 grid grid-rows-5 gap-[1px] p-[1px]">
        <For each={buttons}>
          {(row) => (
            <div class="grid gap-[1px]" style={{ "grid-template-columns": row.length === 3 ? "2fr 1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
              <For each={row}>
                {(btn) => (
                  <button
                    class="flex items-center justify-center text-lg font-light transition-colors active:brightness-125"
                    classList={{
                      "bg-[#ff9f0a] text-white": isOperator(btn) || btn === "=",
                      "bg-[#2c2c2e] text-white": !isOperator(btn) && btn !== "=" && !["C", "±", "%"].includes(btn),
                      "bg-[#3a3a3c] text-white": ["C", "±", "%"].includes(btn),
                    }}
                    onClick={() => handleButton(btn)}
                  >
                    {btn}
                  </button>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default Calculator;
