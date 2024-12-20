// Generate a lobby code. 6 characters long, uppercase, alphanumeric.
export function generateLobbyCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}