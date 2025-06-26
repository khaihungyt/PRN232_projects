# ================= BACKEND (.NET) ==================
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["ArtStep.csproj", "."]
RUN dotnet restore "ArtStep.csproj"
COPY . .
RUN dotnet build "ArtStep.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "ArtStep.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ArtStep.dll"]

# ================= FRONTEND (Next.js) ===============
FROM node:18-alpine AS builder-frontend
WORKDIR /app
COPY Front-end/package*.json ./
RUN npm install --legacy-peer-deps
COPY Front-end/ ./
RUN npm run build

FROM node:18-alpine AS final-frontend
WORKDIR /app
ENV NODE_ENV production
ENV PORT=7216
EXPOSE 7216
COPY --from=builder-frontend /app/.next ./.next
COPY --from=builder-frontend /app/public ./public
COPY --from=builder-frontend /app/node_modules ./node_modules
COPY --from=builder-frontend /app/package.json ./package.json
COPY --from=builder-frontend /app/next.config.mjs ./next.config.mjs
CMD ["npm", "start", "--", "-p", "7216", "-H", "0.0.0.0"]
