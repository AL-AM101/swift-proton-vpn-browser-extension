import {Storage, storage} from '../tools/storage';

export type ConnectionSpeed = {
	downloadPerSecond: number;
	uploadPerSecond: number;
};

export const connectionSpeedItem = storage.item<{value: ConnectionSpeed}>('connection-speed', Storage.SESSION);
