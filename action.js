const stringToDetail = {
  A: ["10", 0],
  B: ["10", 1],
  C: ["11", 0],
  D: ["11", 1],
  E: ["12", 0],
  F: ["12", 1],
  G: ["13", 0],
  H: ["13", 1],
  I: ["14", 0],
  J: ["14", 1],
  K: ["15", 0],
  L: ["15", 1],
  M: ["16", 0],
  N: ["16", 1],
};

const buildJson = require("./functions/buildJson");
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("./admin.json")),
});
const db = admin.firestore();

//concurrent problem
let dateOrder = 0;
module.exports.reserve = async (flexMessageTemplate) => {
  // console.log(dataIndex);
  for (let month = 4; month <= 5; month++) {
    const beginDate = month === 4 ? 10 : 12;
    const endDate = month === 4 ? 14 : 15;

    for (let date = beginDate; date <= endDate; date++) {
      await db
        .collection("Booking-Time")
        .doc(month.toString())
        .collection(date.toString())
        .get()
        .then((querySnapshot) => {
          console.log(`${month}/${date}`);

          let alphabeticalOrder = 0;
          querySnapshot.forEach((doc) => {
            const periodArr = doc.data().period;
            for (let i = 0; i < periodArr.length; i++) {
              let isReserved = periodArr[i];
              flexMessageTemplate = buildJson.insertTimeJson(
                flexMessageTemplate,
                doc.id,
                dateOrder,
                alphabeticalOrder,
                i,
                isReserved
              );
              alphabeticalOrder++;
            }
          });
          flexMessageTemplate.contents.contents[dateOrder].header.contents.push(
            {
              type: "text",
              text: `如需預約請輸入以下格式\n月/日/時段\n舉例：4/10/A`,
              margin: "8px",
              weight: "regular",
              style: "normal",
              size: "19px",
              wrap: true,
            }
          );
          console.log("------------------");
        });
      dateOrder++;
    }
  }
  dateOrder = 0;
  return flexMessageTemplate;
};

module.exports.isReserved = async (request, userID) => {
  const schedule = request.split("/");
  let reply = {
    type: "text",
    text: "success",
  };
  schedule[2] = stringToDetail[schedule[2]];
  const month = schedule[0];
  const date = schedule[1];
  const hour = schedule[2][0];
  const time = schedule[2][1];

  console.log(month, date, hour, time);

  await db
    .collection("Booking-Time")
    .doc(month)
    .collection(date)
    .doc(hour)
    .get()
    .then((doc) => {
      const timeIsReserved = doc.data().period[time];
      if (timeIsReserved) {
        reply.text = "該時間已被預約";
      } else {
        const userIsReserved = false;
        if (userIsReserved) {
          reply.text = "每個帳號只能預約一次";
        } else {
          reply.text = "請輸入email";
          db.collection("userInfo")
            .doc(userID)
            .set({
              email: "",
              reservedTime: [month, date, hour, time],
            });
        }
      }
    });

  return reply;
};
