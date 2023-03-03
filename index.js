require("dotenv").config();
// index.js
const line = require("@line/bot-sdk");
const express = require("express");
const action = require("./action");
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

const app = express();

let flexMessageTemplate = require("./template/flexMsgTemplate.json");

app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      res.status(200).end();
    });
});

// event handler
async function handleEvent(event) {
  const userID = event.source.userId;

  if (event.type !== "message" || event.message.type !== "text") {
    return Promise.resolve(null);
  }

  let reply;
  let request = event.message.text;

  const regex = /^[45]\/1[0-5]\/[A-N]$/;

  console.log(regex.test(request));

  if (request === "預約時間") {
    reply = await action.reserve(flexMessageTemplate);
    await client.replyMessage(event.replyToken, reply);
  } else if (request === "查詢/刪除預約") {
  } else if (regex.test(request)) {
    reply = await action.isReserved(request, userID);
    await client.replyMessage(event.replyToken, reply);
  }
}
// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
