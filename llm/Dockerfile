FROM alpine:3.20

RUN apk add --no-cache bash curl jq

WORKDIR /work

COPY llm/scripts/ /work/scripts/
RUN chmod +x /work/scripts/*.sh

ENV OLLAMA_HOST="http://host.docker.internal:11434"
ENV OLLAMA_MODEL="qwen2.5-coder:14b"

ENTRYPOINT ["/work/scripts/smoke_test.sh"]



