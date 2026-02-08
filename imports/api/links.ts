import { Mongo } from "meteor/mongo";

export interface LinkDoc {
  _id?: string;
  title: string;
  url: string;
  createdAt: Date;
}

export type LinkInsert = Omit<LinkDoc, "_id" | "createdAt">;

export const LinksCollection = new Mongo.Collection<LinkDoc>("links");
