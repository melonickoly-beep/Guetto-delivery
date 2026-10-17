begin;
-- Padronizar as descrições das long necks; manter nomes, preços, fotos e estoques.
update public.produtos p set descricao=v.nova
from (values
  ('3e0e917e-51cc-4aab-a954-dd56759eb6ff'::uuid,'','Pack com 6 garrafas long neck de 330 ml. Cerveja Budweiser.'),
  ('775ad99a-b20f-4f4f-a902-ce86b1c7ef4b'::uuid,'Sem Alcool 330ml','Pack com 6 garrafas long neck de 330 ml. Cerveja Heineken 0 Álcool.'),
  ('3ce40b81-1e24-49c0-aa88-66e124c35b3d'::uuid,'','Pack com 6 garrafas long neck de 330 ml. Cerveja Corona Extra.'),
  ('d9408d29-ecef-478e-af3f-f53af7f0c2bb'::uuid,'','Pack com 6 garrafas long neck de 330 ml. Cerveja Corona 0 Álcool.'),
  ('bb0dba5c-96d8-4233-92e0-2037fee5e30c'::uuid,'Pack com 6 garrafas de 275 ml de cerveja Amstel Ultra.','Pack com 6 garrafas long neck de 275 ml. Cerveja Amstel Ultra sem glúten.'),
  ('9052ca7b-d742-4b8b-acde-ef4dde887a9e'::uuid,'Sem gluten','Pack com 6 garrafas long neck de 330 ml. Cerveja Stella Artois Pure Gold sem glúten.'),
  ('f343dadd-abc4-41a7-8124-f608a8ed7d64'::uuid,'Cerveja Amstel Ultra. Garrafa long neck de 275 ml.','1 garrafa long neck de 275 ml (unidade avulsa). Cerveja Amstel Ultra sem glúten.'),
  ('cf9246e5-ce2a-484a-979d-70a9043ff152'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Sol sem glúten.'),
  ('3befd226-7751-4cd2-9861-8218af5befbc'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Heineken.'),
  ('fa6f1d59-27b7-4469-baa0-c5606f98ba4e'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Spaten.'),
  ('f68be29d-100e-42bd-85f3-55633bd55b18'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 275 ml (unidade avulsa). Cerveja Império Ultra sem glúten.'),
  ('7b21904f-6e93-4ead-b7ee-49dd21dd13ba'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Heineken 0 Álcool.'),
  ('e081c929-f995-498d-a9ce-88696e93346e'::uuid,'','Pack com 6 garrafas long neck de 330 ml. Cerveja Heineken.'),
  ('a16bbe71-ea84-40a2-9f39-17753e2aae2f'::uuid,'','Pack com 6 garrafas long neck de 330 ml. Cerveja Spaten.'),
  ('fbebbfd7-e3bb-43f3-883d-1e336cb5dc0a'::uuid,'Pack com 6 garrafas long neck de 330 ml. Cerveja Michelob
 sem glúten.','Pack com 6 garrafas long neck de 330 ml. Cerveja Michelob Ultra sem glúten.'),
  ('02661e5f-d03a-4e1f-b75a-42c2ec49d7d2'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Stella Artois Pure Gold sem glúten.'),
  ('db59c352-8c36-4148-9fc4-c501bf119820'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Corona 0 Álcool.'),
  ('0c05c874-51c7-47ef-b982-f903a2440ec1'::uuid,'Sem gluten','Pack com 6 garrafas long neck de 275 ml. Cerveja Império Ultra sem glúten.'),
  ('2ad410c6-7f2c-48b1-a5d8-587c74652d50'::uuid,'Sem  Alcool','Pack com 6 garrafas long neck de 330 ml. Cerveja Sol Zero sem álcool.'),
  ('1512fd96-f11c-44fb-9167-83e8bf3feb2d'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Budweiser.'),
  ('bc1cd1b7-01db-43ab-9015-4cdc9a01f2d5'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Michelob Ultra sem glúten.'),
  ('5410180e-81da-42ee-b6f5-770dea8a12a2'::uuid,'Sem gluten','Pack com 6 garrafas long neck de 330 ml. Cerveja Sol sem glúten.'),
  ('817bf42b-398d-4364-ab2b-cc23e1ada80f'::uuid,'','Caixa com 12 garrafas long neck de 275 ml. Cerveja Império Ultra sem glúten.'),
  ('a6989e15-24eb-4555-a35d-9cf6adf26960'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Corona Extra.'),
  ('422cf977-6fda-4e70-b45a-21a2127b265b'::uuid,'Cerveja unidade avulsa','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Sol Zero sem álcool.'),
  ('58341367-8b48-4c2b-bcdb-186f57822776'::uuid,'1 garrafa long neck de 330 ml. Cerveja Heineken Ultimate sem glúten.','1 garrafa long neck de 330 ml (unidade avulsa). Cerveja Heineken Ultimate sem glúten.'),
  ('bc256b42-735d-4692-9875-64df71e78d7c'::uuid,'Pack com 6 garrafas long neck de 330 ml. Cerveja Heineken Ultimate sem glúten.','Pack com 6 garrafas long neck de 330 ml. Cerveja Heineken Ultimate sem glúten.')
) as v(id,anterior,nova) where p.id=v.id and p.descricao is not distinct from v.anterior;
commit;
