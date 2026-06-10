const Riichi = require('riichi');

// console.log("=== 验证场景 1: 立直 + 一发 + 荣和 ===");
// // 234m 123p 567p 345s 22s -> 刚好 14 张
// // 末尾加上 +RI (立直 + 一发)，默认不加 Z 就是荣和（别人点炮）
// var result1 = new Riichi('234m123p567p345s22s+wi').calc();

// console.log("是否错和:", result1.error ? "是" : "否");
// console.log("役种列表:", result1.yaku);
// console.log("总得点:", result1.ten);


// console.log("\n=== 验证场景 2: 双立直 + 自摸 ===");
// // 234m 123p 567p 345s 22s -> 刚好 14 张
// // 末尾加上 +WZ (双立直 + 自摸)
// var result2 = new Riichi('234m123456p567p22s+wi').calc();

// console.log("是否错和:", result2.error ? "是" : "否");
// console.log("役种列表:", result2.yaku);
// console.log("总得点:", result2.ten);


var result1 = new Riichi('234567m33344p+5555s').calc();
console.log("役种列表:", result1.yaku);
console.log("总得点:", result1.ten);



var result2 = new Riichi('234567m56788p+55s').calc();
console.log("役种列表:", result2.yaku);
console.log("总得点:", result2.ten);


const result3 = new Riichi('123m456p13s77z+2s+123p').calc();
// const result3 = new Riichi('1m2m3m1p5p6p1s3s7z7z2s234p+d2m+13').calc();
console.log("役种列表:", result3.yaku);
console.log("总得点:", result3.ten);

const result4 = new Riichi('123m156p13s77z+2s+234p').calc();
// const result3 = new Riichi('1m2m3m1p5p6p1s3s7z7z2s234p+d2m+13').calc();
console.log("役种列表:", result4.yaku);
console.log("总得点:", result4.ten);

// const result5 = new Riichi('1m2m3m4p5p6p1s3s77z+2s+1p2p3p').calc();
// const result5 = new Riichi('111m999p123s2z+2z+44p').calc();
// const result5 = new Riichi('111m999p123s22z+44p+r').calc();
// const result5 = new Riichi('111m999m789s2z+4444p+2z+w').calc(); //1m1m1m9m9m9m7s8s9s2z+4p4p+2z+w11+d7z2p+d2m6m
// const result5 = new Riichi('111m999m789s2z+44p+2z+w').calc(); //1m1m1m9m9m9m7s8s9s2z+4p4p+2z+w11+d7z2p+d2m6m
// const result5 = new Riichi('111m999m789s444p2z+2z+w').calc(); //1m1m1m9m9m9m7s8s9s2z+4p4p+2z+w11+d7z2p+d2m6m
const result5 = new Riichi('111m999m789s2z+44p+2z+lw').calc();
console.log("役种列表:", result5.yaku);
console.log("总得点:", result5.ten);