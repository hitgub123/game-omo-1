const Riichi = require('riichi');

console.log("=== 验证场景 1: 立直 + 一发 + 荣和 ===");
// 234m 123p 567p 345s 22s -> 刚好 14 张
// 末尾加上 +RI (立直 + 一发)，默认不加 Z 就是荣和（别人点炮）
var result1 = new Riichi('234m123p567p345s22s+wi').calc();

console.log("是否错和:", result1.error ? "是" : "否");
console.log("役种列表:", result1.yaku);
console.log("总得点:", result1.ten);


console.log("\n=== 验证场景 2: 双立直 + 自摸 ===");
// 234m 123p 567p 345s 22s -> 刚好 14 张
// 末尾加上 +WZ (双立直 + 自摸)
var result2 = new Riichi('234m123456p567p22s+wi').calc();

console.log("是否错和:", result2.error ? "是" : "否");
console.log("役种列表:", result2.yaku);
console.log("总得点:", result2.ten);