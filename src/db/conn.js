
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';

// const dbName = "v_automate_wos"


// let connUrl = `mongodb://${serverIp}/${databaseName}`
// let databaseName="psirt"
// let connUrl = `mongodb://localhost:27017/${databaseName}`
let databaseName = "Dev_ComplianceEngine"
let connUrl = `mongodb://velocis:password@192.168.100.25:27017/${databaseName}`

// console.log("serverIp", serverIp)

// `mongodb://velocis:password@192.168.100.25:27017/${dbName}

// const client = new MongoClient(`mongodb://velocis:password@192.168.100.25:27017/${dbName}`, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });


// await mongoose.connect(`mongodb://velocis:password@192.168.100.25:27017/${dbName}`, {
//   //  await mongoose.connect(url, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// });

let _db;
// mongoose.set('debug', true);


export default {
  // connectToServer: async function (callback) {
  connectToServer: async function (dbNames, urls, callback) {
    try {
      let url = urls === "" ? connUrl : urls;
      let dbName = dbNames || databaseName
      // let dbName = dbNames === "" ? databaseName : dbNames
      const client = new MongoClient(url, {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
      });

      await mongoose.connect(url, {
        //  await mongoose.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      await client.connect();
      console.log("DB Connected...")
      _db = client.db(dbName);
      // _db = client.db(`${databaseName}`);
      callback()
    } catch (e) {
      console.error("Error in db connection..", e);
      callback(e)
    }

    // _db = client.db(`${dbName}`);
    // return (_db === undefined ? false : true);
  },
  getDb: function () {
    return _db;
  },

};

