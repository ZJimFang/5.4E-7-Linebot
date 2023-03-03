const numberToString = {
  0: "A",
  1: "B",
  2: "C",
  3: "D",
  4: "E",
  5: "F",
  6: "G",
  7: "H",
  8: "I",
  9: "J",
  10: "K",
  11: "L",
  12: "M",
  13: "N",
};

module.exports.insertTimeJson = (
  flexMessageTemplate,
  hour,
  dateOrder,
  alphabeticalOrder,
  i,
  isReserved
) => {
  const format = {
    type: "text",
    text: `
    ${numberToString[alphabeticalOrder]}. ${i === 1 ? hour++ : hour}:${
      i === 0 ? "00" : "30"
    } ~ ${i === 1 ? hour++ : hour}:${i === 0 ? "30" : "00"}`,
    weight: "regular",
    offsetStart: "20px",
    margin: "5px",
  };

  if (isReserved) {
    format.decoration = "line-through";
  }

  flexMessageTemplate.contents.contents[dateOrder].header.contents.push(format);

  return flexMessageTemplate;
};
