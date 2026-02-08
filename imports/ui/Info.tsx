import * as React from "react";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { type LinkDoc, LinksCollection } from "../api/links";

export const Info = () => {
  const isLoading = useSubscribe("links");
  const links = useFind(() => LinksCollection.find()) as LinkDoc[];

  if (isLoading()) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <section>
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-slate-900">
        Learn Meteor!
      </h2>
      <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link._id ?? link.url}>
            <a
              href={link.url}
              className="group block no-underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 transition-colors group-hover:text-red-500">
                    {link.title}
                  </span>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
