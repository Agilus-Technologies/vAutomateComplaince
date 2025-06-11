import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';



// let connUrl = `mongodb://${serverIp}/${databaseName}`
// let databaseName="psirt"
// let connUrl = `mongodb://localhost:27017/${databaseName}`
let databaseName = "Dev_ComplianceEngine"
let connUrl = `mongodb://velocis:password@192.168.100.25:27017/${databaseName}`

// `mongodb://velocis:password@192.168.100.25:27017/${dbName}
let _db;
// mongoose.set('debug', true);


export default {
  connectToServer: async function (dbNames, urls, callback) {
    try {
      let url = urls === "" ? connUrl : urls;
      let dbName = dbNames || databaseName
      const client = new MongoClient(url, {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
      });

      await mongoose.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      await client.connect();
      console.log("DB Connected...")
      _db = client.db(dbName);
      callback()
    } catch (e) {
      console.error("Error in db connection..", e);
      callback(e)
    }
  },
  getDb: function () {
    return _db;
  },
};

