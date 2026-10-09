import { mkdirSync,cpSync,rmSync,existsSync } from 'node:fs';
const files=['index.html','styles.css','app.js','core.js','json.js','content.js','network.svg'];
for(const name of files)if(!existsSync(name))throw new Error('Arquivo ausente: '+name);
rmSync('dist',{recursive:true,force:true});mkdirSync('dist');for(const name of files)cpSync(name,'dist/'+name);
console.log(JSON.stringify({directory:'dist',files:files.length,build:'static'}));
