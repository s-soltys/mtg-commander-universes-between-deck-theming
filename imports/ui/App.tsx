import * as React from "react";
import { Counter } from "./Counter";
import { Header } from "./Header";
import { Info } from "./Info";

export const App = () => (
  <div className="page">
    <Header />
    <main className="main">
      <Counter />
      <Info />
    </main>
  </div>
);
