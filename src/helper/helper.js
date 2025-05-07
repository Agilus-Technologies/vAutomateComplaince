import { createCipheriv } from 'crypto';
import ping from "ping";
import logger from '../../logger.js';

export const decript = (data) => {
    try {
        const decoded = Buffer.from(data, 'base64').toString();
        return decoded;
    } catch (error) {
        console.log("error in decript", error);
    }
}

export function encryptAES(text, key) {
    const cipher = createCipheriv('aes-256-ecb', Buffer.from(key), null);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
};



// export const pingDevice = async (host) => {
//     try {
//         // var hosts = ['192.168.1.1', 'google.com', 'yahoo.com'];
//         // for(let host of hosts){
//         // let res = await ping.promise.probe(host);
//         let res = await ping.promise.probe(host);
//         let msg = res?.alive
//         // let msg = res?.alive ? 'host ' + host + ' is alive' : 'host ' + host + ' is dead';
//         return msg;
//         // }
//     } catch (err) {
//         let msg = `Unable to ping host ${host}::${err}`
//         logger.error(msg)
//         return msg
//     }

// }

export const pingDevice = async (req, res) => {
    try {
        // var hosts = ['192.168.1.1', 'google.com', 'yahoo.com'];
        // for(let host of hosts){
        // let res = await ping.promise.probe(host);
        let { ip } = req.body
        if (!ip) {
            logger.error({ msg: "Unable to get ip from user", status: false })
            return res.send({ msg: "Unable to get ip from user", status: false })
        }
        let result = await ping.promise.probe(ip);
        let msg = result?.alive
        if (msg) {
            let resultMsg = { msg: "Gateway reachable from the current management IP", status: true }
            logger.info(resultMsg)
            return res.send(resultMsg)
        } else {
            let resultMsg = { msg: "Gateway unreachable from the current management IP. Please verify connectivity.", status: false }
            logger.error(resultMsg)
            return res.send(resultMsg)
        }

    } catch (err) {
        let resultMsg = { msg: `Error in pingDevice:${err}`, status: false }
        logger.error(resultMsg)
        return res.send(resultMsg)
    }

}