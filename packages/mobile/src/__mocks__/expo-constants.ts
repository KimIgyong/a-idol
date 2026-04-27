// Minimal expo-constants stub so the api client can import it under jest.
// The client only reads expoConfig.extra.apiBaseUrl; returning undefined
// lets it fall back to the http://localhost:3000/api/v1 default.
export default {
  expoConfig: { extra: {} },
};
