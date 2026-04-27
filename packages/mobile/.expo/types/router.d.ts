/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes:
        | `/`
        | `/(app)`
        | `/(app)/`
        | `/(app)/profile`
        | `/(app)/shop`
        | `/shop`
        | `/(app)/collection`
        | `/collection`
        | `/(app)/auditions`
        | `/(app)/auditions/`
        | `/auditions`
        | `/(auth)`
        | `/(auth)/login`
        | `/(auth)/signup`
        | `/_sitemap`
        | `/login`
        | `/profile`
        | `/signup`;
      DynamicRoutes:
        | `/(app)/idol/${Router.SingleRoutePart<T>}`
        | `/idol/${Router.SingleRoutePart<T>}`
        | `/(app)/chat/${Router.SingleRoutePart<T>}`
        | `/chat/${Router.SingleRoutePart<T>}`
        | `/(app)/auditions/${Router.SingleRoutePart<T>}`
        | `/auditions/${Router.SingleRoutePart<T>}`
        | `/(app)/rounds/${Router.SingleRoutePart<T>}/vote`
        | `/rounds/${Router.SingleRoutePart<T>}/vote`;
      DynamicRouteTemplate:
        | `/(app)/idol/[id]`
        | `/idol/[id]`
        | `/(app)/chat/[idolId]`
        | `/chat/[idolId]`
        | `/(app)/auditions/[id]`
        | `/auditions/[id]`
        | `/(app)/rounds/[id]/vote`
        | `/rounds/[id]/vote`;
    }
  }
}
