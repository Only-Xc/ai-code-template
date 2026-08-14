from app.api_router import api_router
from app.bootstrap import create_app

app = create_app(router=api_router)
