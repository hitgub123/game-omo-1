const syanten = require('../utils/syanten');

    let h1 = [
        [0, 0,0, 0, 0,1, 1, 1, 0], // 万子
        [0, 0, 0, 0, 0, 2, 0, 0, 0],
        [0, 0, 0,0, 0, 0, 1, 1, 4],
        [0, 0, 0, 0, 0, 0, 0]
    ];

   a=syanten.checkMahjongStatus(h1)
   console.log(a)
h2=[0, 0, 0, 0, 0,1, 1, 1, 0,
    0, 0, 0, 0, 0, 2, 0, 0,0,
    0, 0, 0,0, 0, 0, 1, 1, 3,
    0, 0, 0, 0, 0, 0, 0]
x=syanten.getShanten(h2)
console.log(x)