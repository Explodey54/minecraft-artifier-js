const blocks = require("../../static/baked_blocks.json");

onmessage = function (e) {
  const blocksCopy = Object.assign({}, blocks);

  e.data.exclude.forEach((item) => {
    delete blocksCopy[item - 1];
  });

  const imageData = e.data.imgData;

  if (imageData.constructor.name != "Uint8ClampedArray") {
    console.error("not uint8!!!");
    return;
  }

  let output = new Uint8ClampedArray(imageData.length / 4);

  for (let i = 0; i < imageData.length; i += 4) {
    let pixelRgb = {
      red: imageData[i],
      green: imageData[i + 1],
      blue: imageData[i + 2],
      alpha: imageData[i + 3],
    };
    if (pixelRgb.alpha > 70) {
      let temp = false;
      for (let key in blocksCopy) {
        const item = blocksCopy[key];
        let dev =
          Math.abs(pixelRgb.red - item.red) +
          Math.abs(pixelRgb.green - item.green) +
          Math.abs(pixelRgb.blue - item.blue);
        if (!temp || dev < temp.deviation) {
          temp = item;
          temp.deviation = dev;
        }
      }
      output[i / 4] = temp.id;
    } else {
      output[i / 4] = 0;
    }
  }

  postMessage(output);
};
