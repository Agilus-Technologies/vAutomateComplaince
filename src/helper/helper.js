import { createCipheriv } from 'crypto';
import ping from "ping";
import logger from '../../logger.js';
import https from "https"
import axios from "axios";

export const decript = (data) => {
    try {
        const decoded = Buffer.from(data, 'base64').toString();
        // console.log("sdfghj",decoded)
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









