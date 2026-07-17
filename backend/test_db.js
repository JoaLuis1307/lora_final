const { PrismaClient } = require('@prisma/client');

// Use connection string without schema parameter to avoid P1010 on connect
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://admin:admin123@145.79.1.173:5432/iot_db"
    }
  }
});

async function main() {
  try {
    console.log("Intentando conectar a la base de datos...");
    await prisma.$connect();
    console.log("¡Conectado!");

    console.log("Creando esquema 'public' si no existe...");
    await prisma.$executeRawUnsafe("CREATE SCHEMA IF NOT EXISTS public;");
    console.log("Esquema 'public' creado.");

    console.log("Otorgando permisos en esquema 'public'...");
    await prisma.$executeRawUnsafe("GRANT ALL ON SCHEMA public TO admin;");
    await prisma.$executeRawUnsafe("GRANT ALL ON SCHEMA public TO public;");
    console.log("Permisos otorgados con éxito.");

    // Check roles
    const roles = await prisma.$queryRawUnsafe("SELECT rolname, rolsuper, rolcreatedb FROM pg_roles WHERE rolname = 'admin';");
    console.log("Información del rol 'admin':", roles);

  } catch (err) {
    console.error("Error durante la ejecución:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
