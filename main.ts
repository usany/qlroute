import { createSchema, createYoga } from 'graphql-yoga'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

dotenv.config()
export function xmlToJson(xmlString: string) {
  // Simple XML to JSON parser using regex and string manipulation
  function parseElement(xml: string) {
    const result = {};

    // Remove XML declaration and comments
    xml = xml.replace(/<\?xml[^>]*\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");

    // Extract attributes from opening tag
    const attrMatch = xml.match(/<(\w+)([^>]*?)>/);
    if (!attrMatch) return xml.trim();

    const tagName = attrMatch[1];
    const attributes = attrMatch[2];

    // Parse attributes
    if (attributes.trim()) {
      const attrs = {};
      const attrRegex = /(\w+)="([^"]*)"/g;
      let match;
      while ((match = attrRegex.exec(attributes)) !== null) {
        attrs[match[1]] = match[2];
      }
      if (Object.keys(attrs).length > 0) {
        result["@attributes"] = attrs;
      }
    }

    // Extract content between opening and closing tags
    const contentMatch = xml.match(
      new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`),
    );
    if (!contentMatch) {
      // Self-closing tag or empty
      return result;
    }

    let content = contentMatch[1].trim();

    // Check if content contains child elements
    if (content.includes("<")) {
      // Parse child elements
      const childElements = {};
      const tagRegex = /<(\w+)([^>]*?)>([\s\S]*?)<\/\1>/g;
      let match;

      while ((match = tagRegex.exec(content)) !== null) {
        const childTag = match[1];
        const childContent = match[3];
        const parsedChild = parseElement(
          `<${childTag}${match[2]}>${childContent}</${childTag}>`,
        );

        if (childElements[childTag]) {
          if (!Array.isArray(childElements[childTag])) {
            childElements[childTag] = [childElements[childTag]];
          }
          childElements[childTag].push(parsedChild);
        } else {
          childElements[childTag] = parsedChild;
        }
      }

      Object.assign(result, childElements);
    } else if (content) {
      // Text content only
      return content;
    }

    return result;
  }

  return parseElement(xmlString);
}

const schema = `
  type BusArrivalInfo {
    arrmsg1: String
    rtNm: String
    firstTm: String
    lastTm: String
    term: String
    stNm: String
  }

  type GyeonggiBusArrivalInfo {
    routeName: String
    predictTime1: String
    locationNo1: String
    stationNm1: String
  }
    
  type GyeonggiBusRouteInfo {
    routeName: String
    upFirstTime: String
    upLastTime: String
    peekAlloc: String
    nPeekAlloc: String
    satPeekAlloc: String
    satNPeekAlloc: String
    sunPeekAlloc: String
    sunNPeekAlloc: String
    wePeekAlloc: String
    weNPeekAlloc: String
  }

  type SeoulMsgHeader {
    headerCd: String
    headerMsg: String
    itemCount: String
  }

  type SeoulMsgBody {
    itemList: [BusArrivalInfo]
  }

  type SeoulResponse {
    msgHeader: SeoulMsgHeader
    msgBody: SeoulMsgBody
  }

  type SeoulBusResponse {
    response: SeoulResponse
  }

  type GyeonggiHeader {
    resultCode: String
    resultMsg: String
  }

  type GyeonggiBody {
    busArrivalList: [GyeonggiBusArrivalInfo]
  }

  type GyeonggiBusResponse {
    response: GyeonggiResponse
  }

  type GyeonggiResponse {
    msgHeader: GyeonggiHeader
    msgBody: GyeonggiBody
  }
  type GyeonggiRouteBody {
    busRouteInfoItem: GyeonggiBusRouteInfo
  }

  type GyeonggiRouteResponse {
    response: GyeonggiRouteResponseData
  }

  type GyeonggiRouteResponseData {
    msgHeader: GyeonggiHeader
    msgBody: GyeonggiRouteBody
  }

  type Query {
    hello: String
    seoulBusArrival(routeId: Int!): SeoulBusResponse
    gyeonggiBusArrival(stationId: Int!): GyeonggiBusResponse
    gyeonggiBusRoute(routeId: Int!): GyeonggiRouteResponse
    busArrival(routeId: Int!): String
  }

  type Mutation {
    setMessage(message: String!): String
  }
`;
const root = {  
  seoulBusArrival: async (_: any, { routeId }) => {
    try {
      const apiKey = process.env.USERID;
      const url = `http://ws.bus.go.kr/api/rest/arrive/getArrInfoByRouteAll?serviceKey=${apiKey}&busRouteId=${routeId}`;
      const response = await fetch(url);
      const xmlData = await response.text();
      const jsonData = xmlToJson(xmlData);
      // console.log('Fetched Seoul bus data:', jsonData.msgBody.itemList[0]);
      // Transform XML data to match GraphQL schema
      return {
        response: {
          msgBody: {
            itemList: jsonData.msgBody?.itemList?.map(item => {
              console.log(item)
              return ({
              arrmsg1: item.arrmsg1 || '',
              rtNm: item.rtNm || '',
              firstTm: item.firstTm || '',
              lastTm: item.lastTm || '',
              term: item.term || '',
              stNm: item.stNm || ''
            })}) || []
          }
        }
      };
    } catch (error) {
      console.error('Error fetching Seoul bus data:', error);
      return {
        response: {
          msgHeader: {
            headerCd: 'ERROR',
            headerMsg: 'Error fetching Seoul bus data',
            itemCount: '0'
          },
          msgBody: {
            itemList: []
          }
        }
      };
    }
  },

  gyeonggiBusArrival: async (_: any, { stationId }) => {
    try {
      const apiKey = process.env.USERID;
      const url = `https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2?serviceKey=${apiKey}&stationId=${stationId}&format=json`;
      const data = await fetch(url);
      const res = await data.json();
      // console.log('Fetched Gyeonggi bus data:', stationId);
      // console.log('Fetched Gyeonggi bus data:', res.response.msgBody.busArrivalList);
      return res;
    } catch (error) {
      console.error('Error fetching Gyeonggi bus arrival data:', error);
      return {
        response: {
          header: {
            resultCode: 'ERROR',
            resultMsg: 'Error fetching Gyeonggi bus arrival data'
          },
          body: {
            items: {
              item: []
            }
          }
        }
      };
    }
  },

  gyeonggiBusRoute: async (_: any, { routeId }) => {
    console.log(routeId)
    try {
      const apiKey = process.env.USERID;
      const url = `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteInfoItemv2?serviceKey=${apiKey}&routeId=${routeId}&format=json`;
      const response = await fetch(url);
      const apiData = await response.json();
      console.log(apiData)
      // Transform API data to match GraphQL schema
      // const pass = {
      //   response: {
      //     msgBody: {
      //       busRouteInfoItem: {
      //         routeName: apiData?.response?.msgBody?.busRouteInfoItem?.routeName || ''
      //       }
      //     }
      //   }
      // };
      // console.log(pass.response.msgBody.busRouteInfoItem.routeName)
      return apiData
    } catch (error) {
      console.error('Error fetching Gyeonggi bus route data:', error);
      return {
        response: {
          msgHeader: {
            resultCode: 'ERROR',
            resultMsg: 'Error fetching Gyeonggi bus route data'
          },
          msgBody: {
            busRouteInfoItem: []
          }
        }
      };
    }
  },

  // busArrival: async ({ routeId }) => {
  //   try {
  //     const apiKey = process.env.USER;
  //     const url = `https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2?serviceKey=${apiKey}&stationId=${id}&format=json`;
  //     const response = await fetch(url);
  //     const data = await response.text();
  //     return data;
  //   } catch (error) {
  //     console.error('Error fetching bus data:', error);
  //     return 'Error fetching bus data';
  //   }
  // },

  // setMessage: ({ message }) => {
  //   return message;
  // }
};

export default function handler(req, res) {
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: schema,
      resolvers: {
        Query: {
          ...root,
        },
        Mutation: {
          setMessage: ({ message }) => {
            return message;
          }
        }
      },
    }),
    graphqlEndpoint: '/graphql'
  })

  return yoga(req, res)
}

// Start server with Express, CORS, and Helmet
const app = express()

// Create GraphQL Yoga instance
const yoga = createYoga({
  schema: createSchema({
    typeDefs: schema,
    resolvers: {
      Query: {
        ...root,
      },
      Mutation: {
        setMessage: ({ message }) => {
          return message;
        }
      }
    },
  }),
  graphqlEndpoint: '/graphql'
})

const yogaRouter = express.Router()

// GraphiQL specific CSP configuration
yogaRouter.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'style-src': ["'self'", 'unpkg.com'],
        'script-src': ["'self'", 'unpkg.com', "'unsafe-inline'"],
        'img-src': ["'self'", 'raw.githubusercontent.com']
      }
    }
  })
)

yogaRouter.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

yogaRouter.use(yoga)

// By adding the GraphQL Yoga router before the global helmet middleware,
// you can be sure that the global CSP configuration will not be applied to the GraphQL Yoga endpoint
app.use(yoga.graphqlEndpoint, yogaRouter)

// Add the global CSP configuration for the rest of your server
app.use(helmet())
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Add a root route to fix "Cannot GET /" error
app.get('/', (req, res) => {
  res.send('GraphQL Server is running! Visit /graphql for the GraphQL playground.')
})

// You can now register your other endpoints that will not be affected by the GraphiQL CSP configuration
app.get('/hello', (req, res) => {
  res.send('Hello World!')
})

const port = process.env.PORT || 4000

app.listen(port, () => {
  console.log(`Running a GraphQL API server at http://localhost:${port}/graphql`)
})
