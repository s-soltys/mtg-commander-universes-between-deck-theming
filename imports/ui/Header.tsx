import * as React from "react";
import MeteorLogo from "./meteor-logo.svg";

export const Header = () => {
  return (
    <div className="rounded-xl border-b border-slate-200 bg-white">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <MeteorLogo className="h-16 w-16" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          Welcome to Meteor!
        </h1>
      </nav>
    </div>
  );
};
