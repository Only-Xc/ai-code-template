import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

import * as packageConfig from '../package.json'

export function setupSwagger(app) {
  const config = new DocumentBuilder()
    .setTitle(packageConfig.name)
    .setDescription(packageConfig.description)
    .setVersion(packageConfig.version)
    .build()
  const documentFactory = () => SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, documentFactory)
}
