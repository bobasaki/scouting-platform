FROM node:22-bookworm

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH

RUN corepack enable && corepack prepare pnpm@10.6.1 --activate

WORKDIR /workspace
