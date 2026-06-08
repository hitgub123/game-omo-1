// syanten worker - 接收手牌信息，返回 shanten 结果
import { parentPort } from 'worker_threads';
import syanten from 'syanten';

parentPort.on('message', (msg) => {
    let { id, hai } = msg;
    let result = syanten.syanten(hai);
    parentPort.postMessage({ id, result });
});
