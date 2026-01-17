import {storage} from '../tools/storage';

export type SwiftHeartbeat = {
	time: number;
};

export const swiftHeartbeatItem = storage.item<{value: SwiftHeartbeat}>('swift-heartbeat');
