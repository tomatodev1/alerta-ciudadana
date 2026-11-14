-- Datos de prueba para desarrollo y la demostración
insert into public.tipos_incidente (id, nombre, icono, prioridad) values
  (1, 'Robo / Asalto',        'wallet',    1),
  (2, 'Violencia',            'user-x',    1),
  (3, 'Accidente',            'car',       2),
  (4, 'Persona en peligro',   'alert',     1),
  (5, 'Perturbación pública', 'megaphone', 3),
  (6, 'Otro',                 'more',      3);

insert into public.comisarias (nombre, distrito, telefono, latitud, longitud) values
  ('Comisaría San Isidro', 'San Isidro', '01 441 0222', -12.0972, -77.0363),
  ('Comisaría Miraflores', 'Miraflores', '01 445 4060', -12.1219, -77.0297),
  ('Comisaría Surquillo',  'Surquillo',  '01 445 5555', -12.1128, -77.0186);

insert into public.unidades (codigo, placa, comisaria_id, efectivo_cargo, telefono, estado, latitud, longitud) values
  ('Delta-105', 'PL-123', 1, 'S.O. Ramírez', '987 000 105', 'disponible', -12.0890, -77.0180),
  ('Delta-110', 'PL-207', 1, 'S.O. Quispe',  '987 000 110', 'disponible', -12.1000, -77.0400),
  ('Alfa-201',  'PL-315', 2, 'S.O. Torres',  '987 000 201', 'disponible', -12.1200, -77.0300),
  ('Alfa-202',  'PL-318', 3, 'S.O. Huamán',  '987 000 202', 'fuera_de_servicio', -12.1130, -77.0190);

-- Operador de la central: créalo en Authentication > Users (central105@demo.pe) y luego ejecuta:
-- insert into public.perfiles (id, dni, nombres, apellidos, celular, correo, rol, estado_verificacion, verificado_en)
-- select id, '00000105', 'Central', '105', '105', email, 'operador', 'verificada', now()
-- from auth.users where email = 'central105@demo.pe';
