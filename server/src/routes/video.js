import { PrismaClient } from "@prisma/client";
import express from "express";
import { getAuthUser, protect } from "../middleware/authorization";
const prisma = new PrismaClient();

function getVideoRoutes() {
  const router = express.Router();
  router.get("/", getRecommendedVideos);
  router.get("/trending", getTrendingVideos);
  router.get("/search", searchVideos);
  router.get("/:videoId", getAuthUser, getVideo);
  router.delete("/:videoId", protect, deleteVideo);

  router.get("/:videoId/view", getAuthUser, addVideoView);
  router.get("/:videoId/like", protect, likeVideo);
  router.get("/:videoId/dislike", protect, dislikeVideo);
  router.post("/", protect, addVideo);
  router.post("/:videoId/comment", protect, addComment);
  router.delete("/:videoId/comment/:commentId", protect, deleteComment);
  return router;
}

async function getVideosViews(videos) {
  for (let video of videos) {
    const viewsCount = await prisma.view.count({
      where: {
        videoId: {
          equals: video.id,
        },
      },
    });
    video.views = viewsCount;
  }
  return videos;
}

async function getRecommendedVideos(req, res) {
  let videos = await prisma.video.findMany({
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  videos = await getVideosViews(videos);
  if (!videos.length) {
    return res.status(200).json({ videos });
  }

  res.status(200).json({ videos });
}

async function getTrendingVideos(req, res) {
  let videos = await prisma.video.findMany({
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  videos = await getVideosViews(videos);
  if (!videos.length) {
    return res.status(200).json({ videos });
  }
  videos.sort((a, b) => b.views - a.views);

  res.status(200).json({ videos });
}

async function searchVideos(req, res, next) {
  const query = req.query.query;
  console.log({ query });
  if (!query) {
    return next({
      message: "Search term can not be empty",
      statusCode: 400,
    });
  }

  let videos = await prisma.video.findMany({
    include: {
      user: true,
    },
    where: {
      OR: [
        {
          title: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    },
  });
  if (!videos.length) {
    return res.status(400).json({ videos });
  }
  videos = await getVideosViews(videos);
  res.status(200).json({ videos });
}

async function addVideo(req, res) {
  const { title, description, url, thumbnail } = req.body;

  const video = await prisma.video.create({
    data: {
      title,
      description,
      url,
      thumbnail,
      user: {
        connect: {
          id: req.user.id,
        },
      },
    },
  });
  res.status(200).json({ video });
}

async function addComment(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
  });
  if (!video) {
    return next({
      statusCode: 401,
      message: "Video Does not exist",
    });
  }
  const comment = await prisma.comment.create({
    data: {
      text: req.body.text,
      user: {
        connect: {
          id: req.user.id,
        },
      },
      video: {
        connect: {
          id: req.params.videoId,
        },
      },
    },
  });
  res.status(200).json({ comment });
}

async function deleteComment(req, res) {
  const { commentId, videoId } = req.params;
  const comment = await prisma.comment.findUnique({
    where: {
      id: commentId,
    },
    select: {
      userId: true,
    },
  });

  const video = await prisma.video.findUnique({
    where: {
      id: videoId,
    },
  });

  if (!comment && !video) {
    return res.status(400).json({
      message: "Video or Comment not found",
      statusCode: 400,
    });
  }

  if (comment.userId !== req.user.id) {
    return res.status(401).json({
      message: "not authorized",
      statusCode: 401,
    });
  }

  await prisma.comment.delete({
    where: {
      id: commentId,
    },
  });

  res.status(200).json({ message: "comment deleted" });
}

async function addVideoView(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
  });
  if (!video) {
    return next({ statusCode: 404, message: "No video found" });
  }
  if (req.user) {
    await prisma.view.create({
      data: {
        video: {
          connect: {
            id: req.params.videoId,
          },
        },
        user: {
          connect: {
            id: req.user.id,
          },
        },
      },
    });
  } else {
    await prisma.view.create({
      data: {
        video: {
          connect: {
            id: req.params.videoId,
          },
        },
      },
    });
  }
  res.status(200).json({});
}

async function likeVideo(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
  });
  if (!video) {
    return next({ statusCode: 404, message: "No video found" });
  }
  const isLiked = await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: req.params.videoId,
      },
      like: {
        equals: 1,
      },
    },
  });
  const isDisliked = await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: req.params.videoId,
      },
      like: {
        equals: -1,
      },
    },
  });
  if (isLiked) {
    await prisma.videoLike.delete({
      where: {
        id: isLiked.id,
      },
    });
  } else if (isDisliked) {
    await prisma.videoLike.update({
      where: {
        id: isDisliked.id,
      },
      data: {
        like: 1,
      },
    });
  } else {
    await prisma.videoLike.create({
      data: {
        user: {
          connect: {
            id: req.user.id,
          },
        },
        video: {
          connect: {
            id: req.params.videoId,
          },
        },
        like: 1,
      },
    });
  }
  res.status(200).json({});
}

async function dislikeVideo(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
  });
  if (!video) {
    return next({ statusCode: 404, message: "No video found" });
  }
  const isLiked = await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: req.params.videoId,
      },
      like: {
        equals: 1,
      },
    },
  });
  const isDisliked = await prisma.videoLike.findFirst({
    where: {
      userId: {
        equals: req.user.id,
      },
      videoId: {
        equals: req.params.videoId,
      },
      like: {
        equals: -1,
      },
    },
  });
  if (dislikeVideo) {
    await prisma.videoLike.delete({
      where: {
        id: dislikeVideo.id,
      },
    });
  } else if (isLiked) {
    await prisma.videoLike.update({
      where: {
        id: isLiked.id,
      },
      data: {
        like: -1,
      },
    });
  } else {
    await prisma.videoLike.create({
      data: {
        user: {
          connect: {
            id: req.user.id,
          },
        },
        video: {
          connect: {
            id: req.params.videoId,
          },
        },
        like: -1,
      },
    });
  }
  res.status(200).json({});
}

async function getVideo(req, res, next) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
    include: {
      comments: true,
    },
  });

  if (!video) {
    return next({ statusCode: 404, message: "No video found" });
  }

  let isVideoMine = false,
    isLiked = false,
    isDisliked = false,
    isSubscribed = false,
    isViewed = false;

  if (req.user) {
    isLiked = await prisma.videoLike.findFirst({
      where: {
        userId: {
          equals: req.user.id,
        },
        videoId: {
          equals: req.params.videoId,
        },
        like: {
          equals: 1,
        },
      },
    });
    isDisliked = await prisma.videoLike.findFirst({
      where: {
        userId: {
          equals: req.user.id,
        },
        videoId: {
          equals: req.params.videoId,
        },
        like: {
          equals: -1,
        },
      },
    });
    isViewed = await prisma.view.findFirst({
      where: {
        userId: { equals: req.user.id },
        videoId: { equals: video.id },
      },
    });

    isSubscribed = await prisma.subscription.findFirst({
      where: {
        subscriberId: {
          equals: req.user.id,
        },
        subscribedToId: {
          equals: video.userId,
        },
      },
    });
  }
  const likesCount = await prisma.videoLike.count({
    where: {
      AND: {
        videoId: {
          equals: video.id,
        },
        like: {
          equals: 1,
        },
      },
    },
  });
  const dislikes = await prisma.videoLike.count({
    where: {
      AND: {
        videoId: {
          equals: video.id,
        },
        like: {
          equals: -1,
        },
      },
    },
  });

  const views = await prisma.view.count({
    where: {
      videoId: {
        equals: video.id,
      },
    },
  });

  const subscribersCount = await prisma.subscription.count({
    where: {
      subscribedToId: {
        equals: video.userId,
      },
    },
  });

  video.commentsLength = video.comments.length;
  video.isLiked = Boolean(isLiked);
  video.isDisliked = Boolean(isDisliked);
  video.likes = likesCount;
  video.isVideoMine = isVideoMine;
  video.subscribed = Boolean(isSubscribed);
  video.isViewed = Boolean(isViewed);
  video.subscribersCount = subscribersCount;

  res.status(200).json({ video });
}

async function deleteVideo(req, res) {
  const video = await prisma.video.findUnique({
    where: {
      id: req.params.videoId,
    },
    select: {
      userId: true,
    },
  });

  if (!video) {
    return res.status(404).json({ message: "No video found" });
  }

  if (req.user.id !== video.userId) {
    return res.status(401).json({ message: "Not authorized to delete video" });
  }

  await prisma.view.deleteMany({
    where: {
      videoId: {
        equals: req.params.videoId,
      },
    },
  });

  await prisma.videoLike.deleteMany({
    where: {
      videoId: {
        equals: req.params.videoId,
      },
    },
  });

  await prisma.comment.deleteMany({
    where: {
      videoId: {
        equals: req.params.videoId,
      },
    },
  });

  await prisma.comment.deleteMany({
    where: {
      videoId: {
        equals: req.params.videoId,
      },
    },
  });

  await prisma.video.delete({
    where: {
      id: req.params.videoId,
    },
  });

  res.status(200).json({});
}

export { getVideoRoutes };
