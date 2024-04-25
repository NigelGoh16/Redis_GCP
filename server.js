const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(cors());

// const {OAuth2Client} = require('google-auth-library');
// const client2 = new OAuth2Client();
// async function verify() {
//   const ticket = await client2.verifyIdToken({
//       idToken: token,
//       audience: CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
//       // Or, if multiple clients access the backend:
//       //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
//   });
//   const payload = ticket.getPayload();
//   const userid = payload['sub'];
//   // If request specified a G Suite domain:
//   // const domain = payload['hd'];
// }
// verify().catch(console.error);

const redis = require('redis');
const client = redis.createClient({ 
    socket: {
        url: '10.61.205.227',
        port: 6379
  }
});
// const client = redis.createClient({ 
//     url: 'redis://localhost:6379' 
// });
const subscriber = client.duplicate();

client.on('connect', () => {
  console.log('Connected to Redis server successfully!');
//   client.set("test_data", "hi", options = {EX: 10});
});

client.on('error', (error) => {
  console.error('Redis client encountered an error:', error);
});

subscriber.on('error', err => console.error(err));

client.on('publish', message => console.log(message));

(async () => {
    await client.connect();
    await client.configSet(parameter = "notify-keyspace-events", value = "KEx")
    .then(console.log(await client.configGet(parameter = "notify-keyspace-events")));
    await client.configSet(parameter = "active-expire-effort", value = "10");

    await subscriber.connect();
    await subscriber.subscribe('__keyevent@0__:expired', (id) => {
        manual_db(id, expiry = true);
    });

    // await client.publish('__key*__:*', 'message');
})();

// let num = 1;

// async function get_redis(key_name) {
//     num += 1;
//     client.set(`${num}`, "hi", options = {EX: 300});
//     // const data = await client.get(key_name);
//     // console.log(data);
//     console.log(num);
// }

// app.get('/getredis', (req, res) => {
//     get_redis("test_data");
// })

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test'
});

// let current_key = [];
let current_key = 0;
let new_key = 0;

// Handler for the proxy
const variableHandler = {
    set(target, property, value) {
        // console.log(`Variable "${property}" changed from ${target[property]} to ${value}`);
        key_expirer(value);
        target[property] = value;
        return true;
    },
};

const monitoredKey = new Proxy({ value: new_key }, variableHandler);
let executedCount = 0; // Keeps track of executions

function runFunctionAtRandomIntervals(callback, minInterval, maxInterval, targetExecutions) {
    function runWithRandomDelay() {
        if (executedCount >= targetExecutions) {
            return; // Stop execution if target is reached
        }

        const randomDelay = Math.floor(Math.random() * (maxInterval - minInterval)) * 60000 + minInterval * 60000;
        setTimeout(() => {
            callback();
            executedCount++;
            // Continue only if target is not reached
            if (executedCount < targetExecutions) {
                runWithRandomDelay();
            }
        }, randomDelay);
    }

    // Call the function with the first random delay
    runWithRandomDelay();
}

const minInterval = 0.1; // Minimum interval in minutes
const maxInterval = 0.2; // Maximum interval in minutes
const targetExecutions = 50000; // Target number of executions

setTimeout(function(){ runFunctionAtRandomIntervals(db_completion, minInterval, maxInterval, targetExecutions) }, (5 * 60 * 1000));

async function db_completion(){
    const id = Math.floor((Math.random() * 300) + (current_key + 1));
    client.del(args = id.toString());
    manual_db(id, expiry = false);
    console.log(`Deleted ${id}`);
}

async function start_timer(id) {
    // const expiry = Math.floor((Math.random() * 60) + 240);
    const expiry = 1800;
    // const expiry = 300;
    // const expiry = 30;
    const query = `INSERT INTO withdrawal_log (expiry, cat, InProgress, Status) VALUES (${expiry} , 3, 'not in progress', 'pending')`;
    db.query(query, (error, res) => {
        if (error) {
            console.error(`Error inserting data: `, error);
        }
    });
    client.set(`${id}`, " ", options = {EX: expiry});
    // if (current_key.length == 0){
    // if (current_key == -1){    
    //     // current_key.push('1');
    //     setInterval(() => {
    //         key_expirer(new_key);
    //         console.log(current_key);
    //     }, 1000);
    //     current_key = 0;
    // }
}

async function key_expirer(key) {
    if ((key - current_key) > 1){
        // console.log(current_key, key);
        for (var i = key; current_key < i; i--) {
        // await client.EXISTS(current_key.slice(0, 1));
            await client.EXISTS(i.toString());
        // if (current_key.slice(0, 1) != '1') {
        //     current_key.shift();
        // }
        // if (current_key.slice(0, 1) == '1' && current_key.length > 1) {
        //     current_key.shift();
        // }
        }
        current_key = key + 1;
        key += 1;
    }
    else if ((key - current_key) == 1){
        current_key = key;
        key = key;
    }
}

async function manual_db(id, expiry){
    // current_key.push(id);
    if (id > monitoredKey.value && expiry == true){
        monitoredKey.value = id - 1;
    }
    // if (expiry == false) await client.del(toString(id));
    // console.log('manual', new_key);
    const query = `SELECT Status FROM withdrawal_log WHERE id = ${id};`;
    let status = 'success';
    db.query(query, (error, res) => {
        if (error) {
            console.error(`Error updating data: ${id}`, error);
        } else {
            if (res[0].Status == 'pending') {
                status = 'pending';
            }
            if(status == 'pending') {
                const query = `UPDATE withdrawal_log SET timestop = CURRENT_TIMESTAMP, cat = "0", Result = "Updated", InProgress = "not in progress" WHERE id = ${id};`;
                            
                db.query(query, (error, res) => {
                    if (error) {
                        console.error(`Error updating data: ${id}`, error);
                    } else {
                        // console.log('Data updated successfully:');
                    }
                });
            }
        }
    });
    
    if(status == 'pending') {
        const query = `UPDATE withdrawal_log SET cat = "0" WHERE id = ${id};`;
                    
        db.query(query, (error, res) => {
            if (error) {
                console.error(`Error updating data: ${id}`, error);
            } else {
                // console.log('Data updated successfully:', res);
            }
        });
    }
}

app.put('/cachetimer/:id', (req, res) => {
    const id = req.params.id;
    start_timer(id);
    res.status(200).json();
});

app.listen(8080, () => {
    console.log('Server running on port 8080');
})

//

// app.get('/get_withdrawals', (req, res) => {
//     // SQL query to select data from the settlementlog table
//     const query = "SELECT * FROM withdrawal_log WHERE Result = 'Pending';";

//     // Execute the query
//     db.query(query, (error, results) => {
//         if (error) {
//             console.error('Error fetching data:', error);
//             res.status(500).send('Error fetching data from the database');
//         } else {
//             console.log('Data fetched successfully:', results);
//             res.status(200).json(results);
//         }
//     });
// })

// app.get('/test', (req, res) => {
//     const currentdate = new Date(); 
//     const sql = "UPDATE log SET Username = 'haha' WHERE id = 1";
//     db.query(sql, (err, result) => {
//         if (err) throw err;
//         // console.log(result);
//         console.log(currentdate);
//     })
// });


// Manual Counter

// const counters = [];
// var timer_initiate = true;
// const add_counter = (id) => {
//     var obj = { id: id, counter: 20 };
//     counters.push(obj);
//     // setInterval(updateCounters, 1800000);
//     if (timer_initiate){
//         timer = setInterval(updateCounters, 1000);
//         timer_initiate = false;
//     }
// };

// const updateCounters = () => {
//     console.log(counters);
//     if (counters.length > 0) {
//         counters.forEach((counter, index) => {
//             console.log('here', counter.counter);
//             if (counter.counter > 0) {
//                 counter.counter--;
//             }
//             else if (counter.counter === 0) {
//                 const query = `UPDATE withdrawal_log SET Result = "Completed" WHERE id = ${counter.id};`;
                
//                 db.query(query, (error, res) => {
//                     if (error) {
//                         console.error(`Error updating data: ${counter.id}`, error);
//                     } else {
//                         console.log('Data updated successfully:', res);
//                         counters.splice(index, 1);
//                     }
//                 });
//             }
//         });
//     } else {
//         clearInterval(timer);
//         timer_initiate = true;
//     }
// }

// app.put('/add_counter/:id', (req, res) => {
//     const id = req.params.id;
//     console.log(id);
//     add_counter(id);
//     res.status(200).json(counters);
// });




// Pub sub GCP

// const {PubSub} = require('@google-cloud/pubsub');

// const subscriptionNameOrId = 'projects/email-414308/subscriptions/demo-sub';
// const timeout = 60;

// Creates a client; cache this for further use
// const pubSubClient = new PubSub();

// async function publishMessage(topicNameOrId, data) {
//     // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
//     const dataBuffer = Buffer.from(data);

//     try {
//         const messageId = await pubSubClient
//         .topic(topicNameOrId)
//         .publishMessage({data: dataBuffer});
//         console.log(`Message ${messageId} published.`);
//     } catch (error) {
//         console.error(`Received error while publishing: ${error.message}`);
//         process.exitCode = 1;
//     }
// }

// // publishMessage("projects/email-414308/topics/demo", "hi");

// function listenForMessages(subscriptionNameOrId, timeout) {
//     // References an existing subscription
//     const subscription = pubSubClient.subscription(subscriptionNameOrId);

//     // Create an event handler to handle messages
//     let messageCount = 0;
//     const messageHandler = message => {
//         console.log(`Received message ${message.id}:`);
//         console.log(`\tData: ${message.data}`);
//         console.log(`\tAttributes: ${message.attributes}`);
//         messageCount += 1;

//         // "Ack" (acknowledge receipt of) the message
//         message.ack();
//     };

//     // Listen for new messages until timeout is hit
//     subscription.on('message', messageHandler);

//     // Wait a while for the subscription to run. (Part of the sample only.)
//     setTimeout(() => {
//         subscription.removeListener('message', messageHandler);
//         console.log(`${messageCount} message(s) received.`);
//     }, timeout * 1000);
// }

// listenForMessages(subscriptionNameOrId, timeout);