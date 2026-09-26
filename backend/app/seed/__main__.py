import argparse

from app.database import Base, SessionLocal, engine
from app.fts import install_fts
from app.seed.loader import seed_database


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the database with sample meetings")
    parser.add_argument("--reset", action="store_true", help="drop all tables before seeding")
    args = parser.parse_args()

    if args.reset:
        with engine.begin() as conn:
            conn.exec_driver_sql("DROP TABLE IF EXISTS transcript_segments_fts")
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    install_fts(engine)

    with SessionLocal() as db:
        count = seed_database(db, force=args.reset)
    print(f"Seeded {count} meetings" if count else "Database already has meetings, nothing seeded (use --reset)")


if __name__ == "__main__":
    main()
