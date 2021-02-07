import { PrismaClient } from "@prisma/client";
import express from "express";
import { getAuthUser, protect } from "../middleware/authorization";
const prisma = new PrismaClient();

function getVideoRoutes() {
  const router = express.Router();
  router.get("/", getRecommendedVideos);
  router.get("/trending", getTrendingVideos);
  router.get("/search", searchVideos);
  router.get("/:videoId/view", getAuthUser, addVideoView);
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

async function likeVideo(req, res, next) {}

async function dislikeVideo(req, res, next) {}

async function getVideo(req, res, next) {}

async function deleteVideo(req, res) {}

export { getVideoRoutes };
