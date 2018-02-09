const path = require('path')
const Jimp = require("jimp")
const fs = require('fs')
const blocksDb = require('../static/blocks.json')
const arr = []

function rgbToHsl(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

const colorGroups = {
    black: [],
    white: [],
    gray: [],
    red: [],
    orange: [],
    yellow: [],
    green: [],
    lightblue: [],
    blue: [],
    purple: []
}

function getColorGroupHSL(h, s, l) {
    if (l <= 7 || (l <= 20 && s <= 10)) { return 'black' } 
    else if (l >= 93 || (l >= 80 && s <= 10)) { return 'white' } 
    else if (s <= 10) { return 'gray' }
    else {
        if (h > 335 || h <= 10) { return 'red' }
        else if (h > 10 && h <= 45) { return 'orange' }
        else if (h > 45 && h <= 75) { return 'yellow' }
        else if (h > 75 && h <= 150) { return 'green' }
        else if (h > 150 && h <= 200) { return 'lightblue' }
        else if (h > 200 && h <= 260) { return 'blue' }
        else if (h > 260 && h <= 335) { return 'purple' }
    }
}
  
blocksDb.forEach((item, i) => {
    item.id = i + 1
    arr.push(Jimp.read('../static/textures/' + item.texture_image).then(function (image) {
        let redSum = 0
        let greenSum = 0
        let blueSum = 0

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            redSum += this.bitmap.data[ idx + 0 ]
            greenSum += this.bitmap.data[ idx + 1 ]
            blueSum += this.bitmap.data[ idx + 2 ]
        })
        
        let red = Math.round(redSum / (image.bitmap.width * image.bitmap.height))
        let green = Math.round(greenSum / (image.bitmap.width * image.bitmap.height))
        let blue = Math.round(blueSum / (image.bitmap.width * image.bitmap.height))

        let hsl = rgbToHsl(red, green, blue)

        colorGroups[getColorGroupHSL(hsl[0], hsl[1], hsl[2])].push({
            id: item.id,
            hsl: hsl
        })
    }))
})

Promise.all(arr).then(() => {
  fs.writeFile(path.join(__dirname, '../static/baked_colors.json'), JSON.stringify(colorGroups), function(err) {
    if(err) {
        return console.log(err);
    }
  })
  fs.writeFile(path.join(__dirname, '../static/baked_blocks.json'), JSON.stringify(blocksDb), function(err) {
    if(err) {
        return console.log(err);
    }
  })
}, reject => {
  console.log(reject)
})
