import * as React from "react";
import { createRoot } from "react-dom/client";
import { Meteor } from "meteor/meteor";
import { App } from "/imports/ui/App";
import "/imports/ui/styles.css";

Meteor.startup(() => {
  const container: HTMLElement | null = document.getElementById("react-target");
  if (!container) {
    return;
  }

  const root = createRoot(container);
  root.render(<App />);
});
