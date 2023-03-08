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

//concurrent problem
let dateOrder = 0;

module.exports.reserve = async (db, flexMessageTemplate) => {
  const month = 4;
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

            //塞入時段
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

        //塞入格式訊息
        flexMessageTemplate.contents.contents[dateOrder].header.contents.push({
          type: "text",
          text: `如需預約請輸入以下格式\n月/日/時段\n舉例：4/10/A`,
          margin: "8px",
          weight: "regular",
          style: "normal",
          size: "19px",
          wrap: true,
        });
        console.log("------------------");
      });
    dateOrder++;
  }

  dateOrder = 0;
  return flexMessageTemplate;
};

module.exports.isReserved = async (db, request, userID) => {
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

  await db
    .collection("Booking-Time")
    .doc(month)
    .collection(date)
    .doc(hour)
    .get()
    .then(async (doc) => {
      const timeIsReserved = doc.data().period[time];
      if (timeIsReserved) {
        reply.text = "該時間已被預約";
      } else {
        const userIsReserved = await checkIsReserved(db, userID);
        if (userIsReserved) {
          reply.text = "抱歉因多方考量，每個帳號只能預約一次";
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

module.exports.writeEmail = async (db, request, userID) => {
  //user是否已選擇時間
  const userIsReserved = await checkIsReserved(db, userID);

  //user是否已填寫過email
  const hasEmail = await db
    .collection("userInfo")
    .doc(userID)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return doc.data().email === "" ? false : true;
      }
    });

  if (userIsReserved) {
    if (hasEmail) {
      return {
        type: "text",
        text: "您已預約，如需更改資訊請私訊粉絲專頁。",
      };
    } else {
      let month, date, hour, time;

      //update email
      const userInfoRef = db.collection("userInfo").doc(userID);
      await userInfoRef.update({
        email: request,
      });

      //get user reserved time
      await userInfoRef.get().then((doc) => {
        reservedTime = doc.data().reservedTime;
        month = reservedTime[0];
        date = reservedTime[1];
        hour = reservedTime[2];
        block = reservedTime[3];
      });

      //update booking table
      const bookingRef = db
        .collection("Booking-Time")
        .doc(month)
        .collection(date)
        .doc(hour);

      const periodArr = await bookingRef.get().then((doc) => {
        return doc.data().period;
      });

      const userArr = await bookingRef.get().then((doc) => {
        return doc.data().user;
      });

      periodArr[block] = true;
      userArr[block] = userID;

      await bookingRef.update({ period: periodArr, user: userArr });

      return {
        type: "text",
        text: "完成預約，請提前十分鐘抵達現場。",
      };
    }
  } else {
    return {
      type: "text",
      text: "尚未選擇時間。",
    };
  }
};

module.exports.query = async (db, userID) => {
  let month, date, hour, minute;
  let reply = {
    type: "text",
    text: "",
    wrap: true,
  };
  await db
    .collection("userInfo")
    .doc(userID)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const reservedTime = doc.data().reservedTime;
        month = reservedTime[0];
        date = reservedTime[1];
        hour = reservedTime[2];
        minute = reservedTime[3] === 0 ? "00" : "30";
        reply.text = `您預約的時間是${month}/${date} ${hour}:${minute}\n請於十分鐘前抵達現場，謝謝！`;
      } else {
        reply.text = "您尚未預約時段";
      }
    });
  return reply;
};

module.exports.delete = async (db, userID) => {
  let month, date, hour, time;
  const userInfoRef = db.collection("userInfo").doc(userID);

  //update bookingTime
  await userInfoRef.get().then((doc) => {
    reservedTime = doc.data().reservedTime;
    month = reservedTime[0];
    date = reservedTime[1];
    hour = reservedTime[2];
    time = reservedTime[3];
  });

  const bookingRef = db
    .collection("Booking-Time")
    .doc(month)
    .collection(date)
    .doc(hour);

  const periodArr = await bookingRef.get().then((doc) => {
    const arr = doc.data().period;
    arr[time] = false;
    return arr;
  });

  await bookingRef.update({ period: periodArr });

  //delete userInfo
  await userInfoRef.delete();
};

module.exports.changeToWordCloudStatus = async (db, userID, name, avatar) => {
  await db.collection("WordCloud").doc(userID).set({
    status: true,
    name: name,
    text: "",
    avatar: avatar,
  });

  return {
    type: "text",
    text: "有什麼想對5.4E+7說的話嗎？\n請輸入想說的話！並到我們的文字雲專區觀看吧",
    wrap: true,
  };
};

module.exports.writeInWordCloud = async (db, request, userID) => {
  await db.collection("WordCloud").doc(userID).update({
    status: false,
    text: request,
  });
  return {
    type: "text",
    text: "已收到您的回覆，請至文字雲專區查看\n文字雲專區：https://dot4eplus7.web.app/",
    wrap: true,
  };
};

async function checkIsReserved(db, userID) {
  let userIsReserved = await db
    .collection("userInfo")
    .doc(userID)
    .get()
    .then((doc) => {
      return doc.exists ? true : false;
    });

  return userIsReserved;
}
