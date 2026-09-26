import uvicorn

def main():
    uvicorn.run(
        "app.main:app",  # path to your FastAPI app
        host="127.0.0.1",
        port=3001,
        reload=True
    )

if __name__ == "__main__":
    main()