import * as React from "react";
import { useFind, useSubscribe } from "meteor/react-meteor-data";
import { type LinkDoc, LinksCollection } from "../api/links";

export const Info = () => {
  const isLoading = useSubscribe("links");
  const links = useFind(() => LinksCollection.find()) as LinkDoc[];

  if (isLoading()) {
    return <div>Loading...</div>;
  }

  return (
    <section>
      <h2 className="section-title">Learn Meteor!</h2>
      <ul className="resources-grid">
        {links.map((link) => (
          <li className="section" key={link._id ?? link.url}>
            <a href={link.url} className="resource-link" target="_blank">
              <div className="card resource-card">
                <div className="resource-content">
                  <span className="resource-title">{link.title}</span>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
