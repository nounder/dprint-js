// Terrible formatting everywhere
function   hello(name:string){console.log("Hello, "+name)}

const   obj={a:1,b:2,c:3}

interface   Person{name:string;age:number;email?:string}

export   {hello,obj}

const   arr=[1,2,3,4,5].map(x=>x*2).filter(x=>x>5)

type   Status="pending"|"active"|"inactive"

function   process(items:string[]):string[]{return   items.filter(item=>item.length>0).map(item=>item.toUpperCase())}
