export interface IPlayer {
  id: string;
  socketId: string;
  name: string;
  isHost: boolean;
  score?: number;
}
