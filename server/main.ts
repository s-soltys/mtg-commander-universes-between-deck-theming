import { Meteor } from "meteor/meteor";
import "/imports/startup/server/loadEnv";
import "/imports/api/decks/index.server";

Meteor.startup(async () => {
  // Keep startup side effects minimal; deck methods/publications register on import.
});
