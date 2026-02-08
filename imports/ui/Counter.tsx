import * as React from "react";
import { useState } from "react";

export const Counter = () => {
  const [counter, setCounter] = useState<number>(0);

  const increment = () => {
    setCounter(counter + 1);
  };

  return (
    <div className="mb-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:mb-12 md:p-8">
      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <button
          className="inline-flex min-w-[120px] cursor-pointer items-center justify-center rounded-lg bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition-colors transition-transform hover:bg-red-600 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          onClick={increment}
        >
          Click Me :)
        </button>
        <p className="text-center text-slate-500 sm:text-left">
          You've pressed the button{" "}
          <span className="font-semibold text-slate-900">{counter}</span>{" "}
          {counter === 1 ? "time" : "times"}.
        </p>
      </div>
    </div>
  );
};
