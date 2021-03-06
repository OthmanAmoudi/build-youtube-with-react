import { PrismaClient } from "@prisma/client";
import express from "express";
import { getAuthUser, protect } from "../middleware/authorization";
import { getVideosViews } from "./video";
const prisma = new PrismaClient();

function getUserRoutes() {
  const router = express.Router();
  router.get("/", protect, getRecommendedChannels);
  router.get("/liked-videos", protect, getLikedVideos);
  router.get("/history", protect, getHistory);
  router.get("/:userId/subscribe", protect, toggleSubscribe);
  router.get("/subscriptions", protect, getFeed);
  router.get("/search", getAuthUser, searchUser);
  return router;
}

async function getLikedVideos(req, res, next) {
  await getVideos(prisma.videoLike, req, res);
}

async function getHistory(req, res, next) {
  await getVideos(prisma.view, req, res);
}

async function getVideos(model, req, res) {
  const videoRelations = await model.findMany({
    where: {
      userId: req.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const videosIds = videoRelations.map((vidLike) => vidLike.videoId);

  let videos = await model.findMany({
    where: {
      id: {
        in: videosIds,
      },
    },
    include: {
      user: true,
    },
  });

  if (!videos.length) {
    return res.status(200).json({ videos });
  }

  videos = await getVideosViews(videos);
  res.status(200).json({ videos });
}

async function toggleSubscribe(req, res, next) {
  if (req.user.id == req.params.userId) {
    return next({
      message: "you can not subscribe to your own channel",
      statusCode: 400,
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: req.user.id,
    },
  });

  if (!user) {
    return next({
      message: "channel not found",
      statusCode: 404,
    });
  }

  const isSubscribed = await prisma.subscription.findFirst({
    where: {
      subscriberId: {
        equals: req.user.id,
      },
      subscribedToId: {
        equals: req.params.id,
      },
    },
  });

  if (isSubscribed) {
    //unsubscribe
    await prisma.subscription.delete({
      where: {
        id: isSubscribed.id,
      },
    });
  } else {
    //create
    await prisma.subscription.create({
      data: {
        subscriber: {
          connect: {
            id: req.user.id,
          },
        },
        subscribedTo: {
          connect: {
            id: req.params.userId,
          },
        },
      },
    });
  }
  res.status(200).json({});
}

async function getFeed(req, res) {
  const subscribedTo = await prisma.subscription.findMany({
    where: {
      subscriberId: {
        equals: req.user.id,
      },
    },
  });

  const subscribtions = subscribedTo.map((sub) => sub.subscribedToId);

  const feed = await prisma.video.findMany({
    where: {
      userId: {
        in: subscribtions,
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  if (!feed.length) {
    return res.status(200).json({ feed });
  }
  const feedVideos = await getVideosViews(feed);
  res.status(200).json({ feed: feedVideos });
}

async function searchUser(req, res, next) {
  const query = req.query.query;
  if (!query) {
    return next({
      message: "search term can not be empty",
      statusCode: 400,
    });
  }

  const users = await prisma.user.findMany({
    where: {
      username: {
        contains: query,
        mode: "insensitive",
      },
    },
  });

  if (!users) {
    return res.status(200).json({ users });
  }

  for (let user of users) {
    const subscribersCount = await prisma.subscription.count({
      where: {
        subscribedToId: {
          equals: user.id,
        },
      },
    });
    const videosCount = await prisma.video.count({
      where: {
        userId: user.id,
      },
    });
    let isMe = false,
      isSubscribed = false;

    if (req.user) {
      isMe = req.user.id === user.id;
      isSubscribed = await prisma.subscription.findFirst({
        where: {
          AND: {
            subscriberId: {
              equals: req.user.id,
            },
            subscribedToId: {
              equals: user.id,
            },
          },
        },
      });
      user.subscribersCount = subscribersCount;
      user.videosCount = videosCount;
      user.isSubscribed = isSubscribed;
      user.isMe = isMe;
    }
  }

  res.status(200).json({ users });
}

async function getRecommendedChannels(req, res) {
  const channels = await prisma.user.findMany({
    where: {
      id: {
        not: req.user.id,
      },
    },
    take: 10,
  });

  if (!channels.length) {
    return res.status(200).json({ channels });
  }

  for (const channel in channels) {
    const subscribersCount = await prisma.subscription.count({
      where: {
        subscribedToId: {
          equals: channel.id,
        },
      },
    });
    const videosCount = await prisma.video.count({
      where: {
        userId: channel.id,
      },
    });

    const isSubscribed = await prisma.subscription.findFirst({
      where: {
        subscriberId: {
          equals: req.user.id,
        },
        subscribedToId: {
          equals: req.params.id,
        },
      },
    });
  }
}

async function getProfile(req, res, next) {}

async function editUser(req, res) {}

export { getUserRoutes };
