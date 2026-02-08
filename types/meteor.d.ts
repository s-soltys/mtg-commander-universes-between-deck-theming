declare module "meteor/meteor" {
  export const Meteor: {
    isClient: boolean;
    isServer: boolean;
    startup: (fn: () => void | Promise<void>) => void;
    publish: (name: string, handler: (...args: any[]) => any) => void;
    methods: (methods: Record<string, (...args: any[]) => any>) => void;
  };
}

declare module "meteor/random" {
  export const Random: {
    id: (charsCount?: number) => string;
  };
}

declare module "meteor/mongo" {
  export namespace Mongo {
    interface Cursor<T> {
      fetch(): T[];
      countAsync(): Promise<number>;
    }

    class Collection<T extends Record<string, any> = Record<string, any>> {
      constructor(name: string);
      find(selector?: any, options?: any): Cursor<T>;
      insertAsync(doc: T): Promise<string>;
    }
  }
}

declare module "meteor/react-meteor-data" {
  export function useSubscribe(name: string, ...args: any[]): () => boolean;
  export function useFind<T = any>(factory: () => any, deps?: any[]): T[];
}
