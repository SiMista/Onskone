import { io, Socket } from "socket.io-client";

const socket: Socket = io("http://localhost:5003");


export default socket;
