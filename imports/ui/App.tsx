import * as React from "react";
import { Counter } from "./Counter";
import { Header } from "./Header";
import { Info } from "./Info";

export const App = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900">
    <Header />
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <Counter />
      <Info />
    </main>
  </div>
);
