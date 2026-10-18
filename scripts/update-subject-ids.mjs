import fs from 'fs';

const filePath = 'src/constants/initialMaterials.ts';
let content = fs.readFileSync(filePath, 'utf8');

const mapping = {
  "'sub_java'": "'23cs3501_ajp'",
  "'sub_daa'": "'23cs3502_daa'",
  "'sub_adb'": "'23cs3503_ade'",
  "'sub_pe1'": "'23cs3507_pec1'",
  "'sub_oe3'": "'23oecs31_oe3'",
  "'sub_java_lab'": "'23cs3504_ajp_lab'",
  "'sub_daa_lab'": "'23cs3505_daa_lab'",
  "'sub_adb_lab'": "'23cs3506_ade_lab'",
};

for (const [oldId, newId] of Object.entries(mapping)) {
  content = content.replaceAll(oldId, newId);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated all subject IDs in initialMaterials.ts');
