#!/bin/bash
set -e

DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-caseyinhaengsin}"
IMAGE_NAME="resume-builder-web"
VERSION="${1:-latest}"

FULL_IMAGE_NAME="${DOCKERHUB_USERNAME}/${IMAGE_NAME}:${VERSION}"

echo "Building Docker image: ${FULL_IMAGE_NAME}"
docker build --platform linux/amd64 -t "${FULL_IMAGE_NAME}" .

if [ "${VERSION}" != "latest" ]; then
  echo "Tagging as latest..."
  docker tag "${FULL_IMAGE_NAME}" "${DOCKERHUB_USERNAME}/${IMAGE_NAME}:latest"
fi

echo "Pushing to DockerHub..."
docker push "${FULL_IMAGE_NAME}"
if [ "${VERSION}" != "latest" ]; then
  docker push "${DOCKERHUB_USERNAME}/${IMAGE_NAME}:latest"
fi

echo "✓ Build and push complete!"
echo "Image: ${FULL_IMAGE_NAME}"
echo ""
echo "Deploy on the server with docker-compose.prod.yml or via Portainer."
