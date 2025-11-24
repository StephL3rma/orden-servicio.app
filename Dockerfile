# Imagen base oficial
FROM node:22.14.0

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar solo los archivos necesarios para instalar dependencias
COPY package*.json ./

# Instalar dependencias dentro del contenedor
RUN npm install

# Copiar el resto del proyecto (excepto lo ignorado por .dockerignore)
COPY . .

# Exponer el puerto que usa la app
EXPOSE 3000

# Comando por defecto para arrancar
CMD ["node", "index.js"]
